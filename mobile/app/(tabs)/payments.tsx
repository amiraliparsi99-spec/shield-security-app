import { useEffect, useState, useCallback, useRef } from "react";
import { router } from "expo-router";
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
import { getProfileIdAndRole, getVenueId } from "../../lib/auth";
import { getPricingBreakdown } from "../../lib/pricing";

let WebView: any = null;
try { WebView = require("react-native-webview").default; } catch {}

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

interface VenuePaymentItem {
  id: string;
  event_name: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  estimated_total: number | null;
  final_total: number | null;
  staff_requirements: any;
}

function getBookingCost(item: VenuePaymentItem): { total: number; staffCount: number; hours: number; roles: { label: string; count: number; rate: number }[] } {
  const pricing = getPricingBreakdown(item);
  return {
    total: pricing.totalGBP,
    staffCount: pricing.staffCount,
    hours: pricing.hours,
    roles: pricing.roles.map((r) => ({ label: r.label, count: r.count, rate: r.rateGBP })),
  };
}

function VenuePaymentsView({
  insets, refreshing, onRefresh, payments, formatCurrency,
}: {
  insets: { top: number; bottom: number };
  refreshing: boolean;
  onRefresh: () => void;
  payments: VenuePaymentItem[];
  formatCurrency: (n: number) => string;
}) {
  const [selected, setSelected] = useState<VenuePaymentItem | null>(null);

  const totalSpend = payments.reduce((sum, p) => sum + getBookingCost(p).total, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Your booking payment history</Text>

        {/* Total Spend card */}
        <View style={vp.totalCard}>
          <Text style={vp.totalLabel}>Total Spend</Text>
          <Text style={vp.totalAmount}>£{totalSpend.toFixed(2)}</Text>
          <Text style={vp.totalSub}>{payments.length} booking{payments.length !== 1 ? "s" : ""}</Text>
        </View>

        {/* Payment list */}
        <Text style={styles.sectionTitle}>Payment history</Text>
        {payments.length === 0 ? (
          <Text style={styles.emptyText}>No payments yet. Once you complete a booking, it will appear here.</Text>
        ) : (
          payments.map((item) => {
            const { total, staffCount, hours } = getBookingCost(item);
            const statusLower = (item.status || "").toLowerCase();
            const isConfirmed = statusLower === "completed" || statusLower === "confirmed";
            return (
              <TouchableOpacity
                key={item.id}
                style={vp.card}
                onPress={() => setSelected(item)}
                activeOpacity={0.6}
              >
                <View style={[vp.cardIcon, isConfirmed ? vp.cardIconPaid : vp.cardIconPending]}>
                  <Text style={{ fontSize: 16 }}>{isConfirmed ? "🛡️" : "⏳"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={vp.cardName}>{item.event_name || "Security Booking"}</Text>
                  <Text style={vp.cardMeta}>
                    {item.event_date ? new Date(item.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBC"}
                    {hours > 0 ? ` · ${hours.toFixed(1)}h` : ""}
                    {` · ${staffCount} staff`}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={vp.cardPrice}>£{total.toFixed(2)}</Text>
                  <View style={[vp.statusPill, isConfirmed ? vp.statusPaid : vp.statusPending]}>
                    <Text style={[vp.statusText, isConfirmed ? vp.statusTextPaid : vp.statusTextPending]}>
                      {isConfirmed ? "Confirmed" : "Unconfirmed"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={vp.modalOverlay}>
          <View style={[vp.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            {selected && <PaymentDetail item={selected} onClose={() => setSelected(null)} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PaymentDetail({ item, onClose }: { item: VenuePaymentItem; onClose: () => void }) {
  const { total, staffCount, hours, roles } = getBookingCost(item);
  const platformFee = total * 0.05;
  const grandTotal = total + platformFee;
  const statusLower = (item.status || "").toLowerCase();
  const isConfirmed = statusLower === "completed" || statusLower === "confirmed";

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={vp.detailHeader}>
        <Text style={vp.detailTitle}>{item.event_name || "Security Booking"}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={[vp.statusPill, isConfirmed ? vp.statusPaid : vp.statusPending, { alignSelf: "flex-start", marginBottom: spacing.lg }]}>
        <Text style={[vp.statusText, isConfirmed ? vp.statusTextPaid : vp.statusTextPending]}>
          {isConfirmed ? "Security Confirmed" : "Security Unconfirmed"}
        </Text>
      </View>

      {/* Event info */}
      <View style={vp.detailRow}>
        <Text style={vp.detailIcon}>📅</Text>
        <View>
          <Text style={vp.detailLabel}>Date</Text>
          <Text style={vp.detailValue}>
            {item.event_date ? new Date(item.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "TBC"}
          </Text>
        </View>
      </View>

      {item.start_time && item.end_time && (
        <View style={vp.detailRow}>
          <Text style={vp.detailIcon}>⏰</Text>
          <View>
            <Text style={vp.detailLabel}>Time</Text>
            <Text style={vp.detailValue}>{item.start_time} – {item.end_time} ({hours.toFixed(1)} hours)</Text>
          </View>
        </View>
      )}

      <View style={vp.detailRow}>
        <Text style={vp.detailIcon}>👥</Text>
        <View>
          <Text style={vp.detailLabel}>Staff</Text>
          <Text style={vp.detailValue}>{staffCount} personnel</Text>
        </View>
      </View>

      {/* Cost breakdown */}
      <Text style={vp.breakdownTitle}>Cost Breakdown</Text>
      <View style={vp.breakdownCard}>
        {roles.length > 0 ? roles.map((r, i) => (
          <View key={i} style={vp.breakdownRow}>
            <Text style={vp.breakdownLabel}>{r.count}× {r.label} ({hours.toFixed(1)}h @ £{r.rate}/hr)</Text>
            <Text style={vp.breakdownVal}>£{(r.count * r.rate * hours).toFixed(2)}</Text>
          </View>
        )) : (
          <View style={vp.breakdownRow}>
            <Text style={vp.breakdownLabel}>Security services</Text>
            <Text style={vp.breakdownVal}>£{total.toFixed(2)}</Text>
          </View>
        )}
        <View style={vp.breakdownRow}>
          <Text style={vp.breakdownLabel}>Guard fee (deducted from earnings)</Text>
          <Text style={vp.breakdownVal}>£{platformFee.toFixed(2)}</Text>
        </View>
        <View style={vp.breakdownDivider} />
        <View style={vp.breakdownRow}>
          <Text style={vp.breakdownTotalLabel}>Total</Text>
          <Text style={vp.breakdownTotalVal}>£{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={vp.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={vp.closeBtnText}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const vp = StyleSheet.create({
  totalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, padding: spacing.lg, marginBottom: spacing.xl, alignItems: "center" },
  totalLabel: { ...typography.caption, color: colors.textMuted },
  totalAmount: { ...typography.display, color: colors.accent, fontSize: 32, marginTop: 4 },
  totalSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  cardIconPaid: { backgroundColor: "rgba(16,185,129,0.15)" },
  cardIconPending: { backgroundColor: "rgba(245,158,11,0.15)" },
  cardName: { ...typography.body, color: colors.text, fontWeight: "600" },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  cardPrice: { ...typography.body, color: colors.text, fontWeight: "700", fontSize: 16 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  statusPaid: { backgroundColor: "rgba(16,185,129,0.15)" },
  statusPending: { backgroundColor: "rgba(245,158,11,0.15)" },
  statusText: { ...typography.caption, fontWeight: "600", fontSize: 10 },
  statusTextPaid: { color: "#10B981" },
  statusTextPending: { color: "#F59E0B" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: "85%" },

  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  detailTitle: { ...typography.title, color: colors.text, fontSize: 20, flex: 1, marginRight: spacing.md },
  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  detailIcon: { fontSize: 18, marginRight: spacing.md, marginTop: 2 },
  detailLabel: { ...typography.caption, color: colors.textMuted },
  detailValue: { ...typography.body, color: colors.text, fontWeight: "500" },

  breakdownTitle: { ...typography.body, color: colors.text, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.sm },
  breakdownCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  breakdownLabel: { ...typography.bodySmall, color: colors.textMuted },
  breakdownVal: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
  breakdownDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  breakdownTotalLabel: { ...typography.body, color: colors.text, fontWeight: "700" },
  breakdownTotalVal: { ...typography.body, color: colors.accent, fontWeight: "700" },

  closeBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
  closeBtnText: { ...typography.body, color: colors.textMuted, fontWeight: "600" },
});

// In iOS Simulator, localhost is the simulator—use your Mac's IP (e.g. http://192.168.1.x:3000) or run on device with same network
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const API_FETCH_TIMEOUT_MS = 8000;

export default function PaymentsTab() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PayoutRequest[]>([]);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [hasStripeAccount, setHasStripeAccount] = useState(false);
  const [stripeConnectOnboardingUrl, setStripeConnectOnboardingUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [venuePayments, setVenuePayments] = useState<VenuePaymentItem[]>([]);

  // Bank details form state
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
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const profileData = await getProfileIdAndRole(supabase, session.user.id);
      setRole(profileData?.role || null);

      if (profileData?.role === "venue") {
        const vid = await getVenueId(supabase, profileData.profileId);
        if (!vid) {
          setVenuePayments([]);
          return;
        }

        const { data: paymentsData } = await supabase
          .from("bookings")
          .select("id, event_name, event_date, start_time, end_time, status, estimated_total, final_total, staff_requirements")
          .eq("venue_id", vid)
          .order("event_date", { ascending: false })
          .limit(40);

        setVenuePayments((paymentsData || []) as VenuePaymentItem[]);
        return;
      }

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

      // Check Stripe account status via API (with timeout so simulator doesn't hang on unreachable localhost)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);
        const connectResponse = await fetch(`${API_BASE}/api/stripe/connect`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (connectResponse.ok) {
          const connectData = await connectResponse.json();
          setHasStripeAccount(connectData.has_stripe_account);
          setOnboardingComplete(connectData.onboarding_complete || false);
        } else {
          const { data: stripeAccount } = await supabase
            .from("stripe_accounts")
            .select("*")
            .eq("user_id", session.user.id)
            .single();
          setHasStripeAccount(!!stripeAccount);
          setOnboardingComplete(stripeAccount?.onboarding_complete || false);
        }
      } catch {
        // API unreachable (e.g. simulator can't reach localhost)—use DB fallback
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

  const handleStartStripeOnboarding = async () => {
    setBankError(null);
    setIsSubmittingBank(true);
    if (!supabase) return;
    try {
      if (!WebView) {
        setBankError("Stripe onboarding needs a development build (native in-app WebView).");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBankError("Please log in first");
        return;
      }

      const connectCompleteUrl = `${API_BASE}/api/stripe/connect/complete?source=mobile`;

      const response = await fetch(`${API_BASE}/api/stripe/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          return_url: connectCompleteUrl,
          refresh_url: connectCompleteUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setBankError(data.error || "Failed to start Stripe onboarding");
        return;
      }

      if (!data.onboarding_url) {
        setBankError("Stripe didn't return an onboarding link");
        return;
      }

      setStripeConnectOnboardingUrl(data.onboarding_url);
      setHasStripeAccount(true);
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
            if (!supabase) return;
            setIsWithdrawing(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error("Not authenticated");

              // Create payout request
              const fee = withdrawMethod === "instant" ? getInstantFee().fee : 0;
              const netAmount = amount - fee;

              if (!supabase) return;
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

  if (role === "venue") {
    return <VenuePaymentsView
      insets={insets}
      refreshing={refreshing}
      onRefresh={onRefresh}
      payments={venuePayments}
      formatCurrency={formatCurrency}
    />;
  }

  // Onboarding screen - Stripe Connect Express onboarding
  if (!onboardingComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.onboardingContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.onboardingTitle}>Set Up Payments</Text>
          <Text style={styles.onboardingDescription}>
            Connect your bank account with Stripe so you can receive payouts.
          </Text>

          {bankError && (
            <View style={styles.bankErrorBox}>
              <Text style={styles.bankErrorText}>{bankError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.bankSubmitButton, isSubmittingBank && styles.bankSubmitDisabled]}
            onPress={handleStartStripeOnboarding}
            disabled={isSubmittingBank}
          >
            {isSubmittingBank ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.bankSubmitText}>Connect Bank Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bankSecurityInfo}>
            <Text style={styles.bankSecurityIcon}>🔒</Text>
            <Text style={styles.bankSecurityText}>
              You'll be guided through Stripe's secure onboarding to verify your identity and connect your bank. Your details are never stored on our servers.
            </Text>
          </View>
        </ScrollView>

        {stripeConnectOnboardingUrl && WebView && (
          <Modal visible animationType="slide" onRequestClose={() => setStripeConnectOnboardingUrl(null)}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={styles.modalContentHeader}>
                <Text style={styles.modalTitle}>Connect to Stripe</Text>
                <TouchableOpacity onPress={() => setStripeConnectOnboardingUrl(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
              <WebView
                source={{ uri: stripeConnectOnboardingUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled
                onNavigationStateChange={(navState: any) => {
                  const url = navState?.url || "";
                  if (url.includes("shield://payments") || url.includes("/api/stripe/connect/complete")) {
                    setStripeConnectOnboardingUrl(null);
                    fetchData();
                  }
                }}
              />
            </View>
          </Modal>
        )}
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
  venueBankWarning: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  venueBankWarningTitle: {
    ...typography.body,
    color: "#F59E0B",
    fontWeight: "700",
    marginBottom: 4,
  },
  venueBankWarningText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  venuePaymentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  statusPillText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  venueAmount: {
    ...typography.titleCard,
    color: colors.text,
  },
  payNowBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  payNowBtnText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
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
  modalContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 50,
  },
  modalCloseBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCloseBtnText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
});
