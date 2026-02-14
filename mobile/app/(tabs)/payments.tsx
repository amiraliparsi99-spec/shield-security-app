import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";

interface Wallet {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

interface Transaction {
  id: string;
  type: "payment" | "payout" | "refund";
  status: string;
  gross_amount: number;
  net_amount: number;
  created_at: string;
  description?: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payout_method: "instant" | "standard";
  status: string;
  estimated_arrival?: string;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export default function PaymentsTab() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutRequest[]>([]);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [hasStripeAccount, setHasStripeAccount] = useState(false);
  
  // Bank details form state
  const [bankFullName, setBankFullName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"instant" | "standard">("standard");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    fetchData();

    // Re-fetch when app comes back to foreground (e.g. returning from Stripe onboarding)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        fetchData();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch wallet data
      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (walletData) {
        setWallet(walletData);
      } else {
        // Create wallet if doesn't exist
        const { data: newWallet } = await supabase
          .from("wallets")
          .insert({ user_id: session.user.id })
          .select()
          .single();
        setWallet(newWallet);
      }

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .or(`payer_id.eq.${session.user.id},payee_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      
      setTransactions(txData || []);

      // Fetch pending payouts
      const { data: payoutData } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false });
      
      setPendingPayouts(payoutData || []);

      // Check Stripe account status via API (gets LIVE status from Stripe)
      try {
        const connectResponse = await fetch(`${API_BASE}/api/stripe/connect`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });
        
        if (connectResponse.ok) {
          const connectData = await connectResponse.json();
          setHasStripeAccount(connectData.has_stripe_account);
          setOnboardingComplete(connectData.onboarding_complete || false);
        } else {
          // Fallback to local database check
          const { data: stripeAccount } = await supabase
            .from("stripe_accounts")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          setHasStripeAccount(!!stripeAccount);
          setOnboardingComplete(stripeAccount?.onboarding_complete || false);
        }
      } catch {
        // Fallback to local database check if API is unreachable
        const { data: stripeAccount } = await supabase
          .from("stripe_accounts")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        setHasStripeAccount(!!stripeAccount);
        setOnboardingComplete(stripeAccount?.onboarding_complete || false);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const formatCurrency = (amountInPence: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amountInPence / 100);
  };

  const getInstantFee = () => {
    const amount = Math.round(parseFloat(withdrawAmount || "0") * 100);
    const fee = Math.max(50, Math.round(amount * 0.01));
    return { fee, net: amount - fee };
  };

  // Format sort code as XX-XX-XX
  const formatSortCode = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const handleSubmitBankDetails = async () => {
    setBankError(null);

    // Validate
    if (!bankFullName.trim()) {
      setBankError("Please enter the account holder's full name");
      return;
    }

    const cleanSortCode = bankSortCode.replace(/[-\s]/g, "");
    if (!/^\d{6}$/.test(cleanSortCode)) {
      setBankError("Sort code must be 6 digits (e.g. 12-34-56)");
      return;
    }

    const cleanAccountNumber = bankAccountNumber.replace(/\s/g, "");
    if (!/^\d{8}$/.test(cleanAccountNumber)) {
      setBankError("Account number must be 8 digits");
      return;
    }

    setIsSubmittingBank(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBankError("Please log in first");
        return;
      }

      const response = await fetch(`${API_BASE}/api/stripe/connect/bank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: bankFullName.trim(),
          sort_code: cleanSortCode,
          account_number: cleanAccountNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBankError(data.error || "Failed to connect bank account");
        return;
      }

      // Success - refresh data to show payments dashboard
      setOnboardingComplete(true);
      setHasStripeAccount(true);
      fetchData();
    } catch (err: any) {
      setBankError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isWithdrawing) return;

    const amount = Math.round(parseFloat(withdrawAmount) * 100);
    if (amount < 1000) {
      Alert.alert("Minimum £10", "The minimum withdrawal amount is £10");
      return;
    }

    if (!wallet || amount > wallet.available_balance) {
      Alert.alert("Insufficient Balance", "You don't have enough available balance");
      return;
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ${formatCurrency(withdrawMethod === "instant" ? getInstantFee().net : amount)} via ${withdrawMethod === "instant" ? "Instant (1% fee)" : "Standard (free)"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setIsWithdrawing(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error("Not authenticated");

              // Create payout request
              const fee = withdrawMethod === "instant" ? getInstantFee().fee : 0;
              const netAmount = amount - fee;

              const { data: payout, error } = await supabase
                .from("payout_requests")
                .insert({
                  user_id: session.user.id,
                  amount,
                  fee,
                  net_amount: netAmount,
                  payout_method: withdrawMethod,
                  status: "pending",
                })
                .select()
                .single();

              if (error) throw error;

              // Deduct from wallet locally (webhook will confirm)
              setWallet(prev => prev ? {
                ...prev,
                available_balance: prev.available_balance - amount,
              } : null);

              setPendingPayouts(prev => [payout, ...prev]);
              setShowWithdrawModal(false);
              setWithdrawAmount("");
              
              Alert.alert("Success", "Your withdrawal request has been submitted!");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setIsWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Onboarding screen - native bank details form
  if (!onboardingComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView 
          contentContainerStyle={styles.onboardingContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.onboardingTitle}>Set Up Payments</Text>
          <Text style={styles.onboardingDescription}>
            Enter your bank details to receive payments from bookings.
          </Text>

          <View style={styles.bankForm}>
            {/* Full Name */}
            <View style={styles.bankField}>
              <Text style={styles.bankLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.bankInput}
                value={bankFullName}
                onChangeText={setBankFullName}
                placeholder="e.g. John Smith"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Sort Code */}
            <View style={styles.bankField}>
              <Text style={styles.bankLabel}>Sort Code</Text>
              <TextInput
                style={styles.bankInput}
                value={bankSortCode}
                onChangeText={(text) => setBankSortCode(formatSortCode(text))}
                placeholder="12-34-56"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>

            {/* Account Number */}
            <View style={styles.bankField}>
              <Text style={styles.bankLabel}>Account Number</Text>
              <TextInput
                style={styles.bankInput}
                value={bankAccountNumber}
                onChangeText={(text) => setBankAccountNumber(text.replace(/\D/g, "").slice(0, 8))}
                placeholder="12345678"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={8}
              />
            </View>

            {/* Error message */}
            {bankError && (
              <View style={styles.bankErrorBox}>
                <Text style={styles.bankErrorText}>{bankError}</Text>
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.bankSubmitButton, isSubmittingBank && styles.bankSubmitDisabled]}
              onPress={handleSubmitBankDetails}
              disabled={isSubmittingBank}
            >
              {isSubmittingBank ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.bankSubmitText}>Connect Bank Account</Text>
              )}
            </TouchableOpacity>

            {/* Security info */}
            <View style={styles.bankSecurityInfo}>
              <Text style={styles.bankSecurityIcon}>🔒</Text>
              <Text style={styles.bankSecurityText}>
                Your bank details are sent directly to Stripe and are never stored on our servers. All payments are processed securely.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Manage your earnings and withdrawals</Text>

        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceCard, styles.availableCard]}>
            <Text style={styles.balanceLabel}>Available</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(wallet?.available_balance || 0)}</Text>
            <TouchableOpacity
              style={[styles.withdrawButton, (wallet?.available_balance || 0) < 1000 && styles.withdrawButtonDisabled]}
              onPress={() => setShowWithdrawModal(true)}
              disabled={(wallet?.available_balance || 0) < 1000}
            >
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Pending</Text>
            <Text style={[styles.balanceAmount, styles.pendingAmount]}>
              {formatCurrency(wallet?.pending_balance || 0)}
            </Text>
            <Text style={styles.balanceHint}>Clearing soon</Text>
          </View>
        </View>

        {/* Total Earned */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statValue}>{formatCurrency(wallet?.total_earned || 0)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>{formatCurrency(wallet?.total_withdrawn || 0)}</Text>
          </View>
        </View>

        {/* Pending Payouts */}
        {pendingPayouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Withdrawals</Text>
            {pendingPayouts.map((payout) => (
              <View key={payout.id} style={styles.payoutCard}>
                <View>
                  <Text style={styles.payoutAmount}>{formatCurrency(payout.net_amount)}</Text>
                  <Text style={styles.payoutMeta}>
                    {payout.payout_method === "instant" ? "⚡ Instant" : "🏦 Standard"}
                  </Text>
                </View>
                <View style={styles.payoutStatus}>
                  <Text style={styles.payoutStatusText}>{payout.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet</Text>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionCard}>
                <View style={[styles.txIcon, 
                  tx.type === "payment" ? styles.txIconPayment :
                  tx.type === "payout" ? styles.txIconPayout :
                  styles.txIconRefund
                ]}>
                  <Text style={styles.txIconText}>
                    {tx.type === "payment" ? "💰" : tx.type === "payout" ? "🏦" : "↩️"}
                  </Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>
                    {tx.type === "payment" ? "Payment received" :
                     tx.type === "payout" ? "Withdrawal" : "Refund"}
                  </Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                  </Text>
                </View>
                <View style={styles.txAmount}>
                  <Text style={[styles.txAmountText,
                    tx.type === "payment" ? styles.txAmountPositive :
                    styles.txAmountNegative
                  ]}>
                    {tx.type === "payment" ? "+" : "-"}{formatCurrency(tx.net_amount)}
                  </Text>
                  <Text style={[styles.txStatus,
                    tx.status === "succeeded" ? styles.txStatusSuccess :
                    tx.status === "pending" || tx.status === "processing" ? styles.txStatusPending :
                    styles.txStatusFailed
                  ]}>
                    {tx.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Amount (£)</Text>
              <TextInput
                style={styles.modalInput}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.modalHint}>
                Available: {formatCurrency(wallet?.available_balance || 0)} • Min: £10
              </Text>
            </View>

            <View style={styles.methodOptions}>
              <TouchableOpacity
                style={[styles.methodOption, withdrawMethod === "standard" && styles.methodOptionActive]}
                onPress={() => setWithdrawMethod("standard")}
              >
                <Text style={styles.methodIcon}>🏦</Text>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>Standard</Text>
                  <Text style={styles.methodDetail}>2-3 days • Free</Text>
                </View>
                <Text style={styles.methodAmount}>
                  {formatCurrency(Math.round(parseFloat(withdrawAmount || "0") * 100))}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodOption, withdrawMethod === "instant" && styles.methodOptionActive]}
                onPress={() => setWithdrawMethod("instant")}
              >
                <Text style={styles.methodIcon}>⚡</Text>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>Instant</Text>
                  <Text style={styles.methodDetail}>~30 mins • 1% fee</Text>
                </View>
                <View style={styles.methodAmountContainer}>
                  <Text style={styles.methodAmount}>{formatCurrency(getInstantFee().net)}</Text>
                  <Text style={styles.methodFee}>Fee: {formatCurrency(getInstantFee().fee)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, (!withdrawAmount || parseFloat(withdrawAmount) < 10) && styles.modalConfirmDisabled]}
                onPress={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) < 10 || isWithdrawing}
              >
                {isWithdrawing ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  
  // Balance Cards
  balanceRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availableCard: {
    borderColor: colors.accent,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  balanceAmount: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    marginTop: spacing.xs,
  },
  pendingAmount: {
    color: colors.warning,
  },
  balanceHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  withdrawButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    alignItems: "center",
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },

  // Stats Card
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statValue: {
    ...typography.titleCard,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },

  // Payout Cards
  payoutCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutAmount: {
    ...typography.titleCard,
    color: colors.text,
  },
  payoutMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  payoutStatus: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  payoutStatusText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "500",
  },

  // Transaction Cards
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  txIconPayment: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  txIconPayout: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  txIconRefund: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  txIconText: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  txDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    alignItems: "flex-end",
  },
  txAmountText: {
    ...typography.titleCard,
  },
  txAmountPositive: {
    color: colors.success,
  },
  txAmountNegative: {
    color: colors.textMuted,
  },
  txStatus: {
    ...typography.caption,
    marginTop: 2,
  },
  txStatusSuccess: {
    color: colors.success,
  },
  txStatusPending: {
    color: colors.warning,
  },
  txStatusFailed: {
    color: colors.error,
  },

  // Onboarding / Bank Form
  onboardingContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  onboardingTitle: {
    ...typography.display,
    fontSize: 28,
    color: colors.text,
  },
  onboardingDescription: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  bankForm: {
    gap: spacing.md,
  },
  bankField: {
    gap: spacing.xs,
  },
  bankLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
  bankInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    ...typography.body,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    letterSpacing: 0.5,
  },
  bankErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: spacing.md,
  },
  bankErrorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  bankSubmitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  bankSubmitDisabled: {
    opacity: 0.6,
  },
  bankSubmitText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  bankSecurityInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bankSecurityIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  bankSecurityText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.display,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  modalField: {
    marginBottom: spacing.lg,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.display,
    fontSize: 28,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  methodOptions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  methodDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  methodAmountContainer: {
    alignItems: "flex-end",
  },
  methodAmount: {
    ...typography.titleCard,
    color: colors.text,
  },
  methodFee: {
    ...typography.caption,
    color: colors.textMuted,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  modalConfirmDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
