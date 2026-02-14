import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography, spacing, radius } from "../../../theme";
import { supabase } from "../../../lib/supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

interface BookingDetails {
  id: string;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guards_count: number;
  rate: number;
  currency: string;
  status: string;
  payment_status: string;
  provider_type: string;
  provider_id: string;
  personnel?: {
    id: string;
    display_name: string;
    user_id: string;
  };
  venue?: {
    name: string;
  };
}

export default function PayBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, event_name, event_date, start_time, end_time, 
          guards_count, rate, currency, status, payment_status,
          provider_type, provider_id,
          personnel:provider_id (id, display_name, user_id),
          venue:venue_id (name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setBooking(data as BookingDetails);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amountInPence: number, currency: string = "GBP") => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency,
    }).format(amountInPence / 100);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const handlePayment = async () => {
    if (!booking || !booking.personnel?.user_id) {
      Alert.alert("Error", "Unable to process payment. Guard information missing.");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Please log in to continue");
        return;
      }

      // Create payment intent
      const response = await fetch(`${API_BASE}/api/stripe/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          amount: booking.rate,
          payee_id: booking.personnel.user_id,
          description: `Payment for ${booking.event_name || "Security Shift"} on ${formatDate(booking.event_date)}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("not completed payment setup")) {
          Alert.alert(
            "Guard Not Set Up",
            "The guard hasn't completed their payment setup yet. Please contact them to complete their Stripe onboarding before you can pay.",
            [{ text: "OK" }]
          );
        } else {
          throw new Error(data.error || "Failed to create payment");
        }
        return;
      }

      // For mobile, we'll use Stripe's hosted checkout page
      // Create a checkout session URL
      const checkoutUrl = `${API_BASE}/checkout?payment_intent=${data.payment_intent_id}&client_secret=${data.client_secret}&booking_id=${booking.id}`;
      
      // Open in browser for payment
      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkoutUrl);
        Alert.alert(
          "Complete Payment",
          "After completing the payment in your browser, come back here and pull down to refresh to see the updated status.",
          [
            { 
              text: "OK", 
              onPress: () => {
                // Refresh booking details
                fetchBookingDetails();
              }
            }
          ]
        );
      } else {
        // Fallback: show payment details
        Alert.alert(
          "Payment Ready",
          `Amount: ${formatCurrency(data.amount)}\nPayment ID: ${data.payment_intent_id}\n\nPlease complete this payment on the web app.`,
          [{ text: "OK" }]
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || "Booking not found"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBookingDetails}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Already paid
  if (booking.payment_status === "paid") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Payment Complete</Text>
          <Text style={styles.successText}>
            This booking has already been paid.
          </Text>
          <View style={styles.paidSummary}>
            <Text style={styles.paidAmount}>{formatCurrency(booking.rate, booking.currency)}</Text>
            <Text style={styles.paidLabel}>Paid to {booking.personnel?.display_name || "Guard"}</Text>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay for Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Booking Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{booking.event_name || "Security Shift"}</Text>
          <Text style={styles.summaryDate}>{formatDate(booking.event_date)}</Text>
          
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Guard</Text>
            <Text style={styles.detailValue}>{booking.personnel?.display_name || "Personnel"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{booking.start_time} - {booking.end_time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Guards</Text>
            <Text style={styles.detailValue}>{booking.guards_count}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{booking.status}</Text>
            </View>
          </View>
        </View>

        {/* Payment Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>{formatCurrency(booking.rate, booking.currency)}</Text>
          <Text style={styles.amountHint}>Includes all fees and charges</Text>
        </View>

        {/* Payment Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🔒</Text>
          <Text style={styles.infoText}>
            Payments are processed securely through Stripe. Your payment details are never stored on our servers.
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <>
              <Text style={styles.payButtonText}>Pay {formatCurrency(booking.rate, booking.currency)}</Text>
              <Text style={styles.payButtonSubtext}>Secure payment via Stripe</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    ...typography.body,
    color: colors.accent,
  },
  headerTitle: {
    ...typography.titleCard,
    color: colors.text,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.display,
    fontSize: 22,
    color: colors.text,
  },
  summaryDate: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  statusBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  // Amount Card
  amountCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  amountLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  amountValue: {
    ...typography.display,
    fontSize: 36,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  amountHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Info Card
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  payButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    ...typography.titleCard,
    color: colors.text,
  },
  payButtonSubtext: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.8,
    marginTop: 2,
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.accent,
  },

  // Success State
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  paidSummary: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    width: "100%",
  },
  paidAmount: {
    ...typography.display,
    fontSize: 32,
    color: colors.success,
  },
  paidLabel: {
    ...typography.body,
    color: colors.success,
    marginTop: spacing.xs,
  },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  doneButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
