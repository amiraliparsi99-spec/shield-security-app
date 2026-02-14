import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Alert, Vibration } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getVenueById } from "../../../../data/dashboard";
import type { VenueRequest, Venue } from "../../../../data/dashboard";
import { supabase } from "../../../../lib/supabase";
import { getProfileIdAndRole, getPersonnelId } from "../../../../lib/auth";
import { colors, typography, spacing, radius } from "../../../../theme";
import { GradientBackground, GlassCard, GlowButton, FadeInView } from "../../../../components/ui/Glass";
import { BackButton } from "../../../../components/ui/BackButton";
import { safeHaptic } from "../../../../lib/haptics";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTimeRange(start: string, end?: string) {
  try {
    const s = new Date(start);
    const startStr = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (end) {
      const e = new Date(end);
      return `${startStr} – ${e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return startStr;
  } catch {
    return start;
  }
}

function VenueTypeLabel(t: string) {
  const labels: Record<string, string> = {
    club: "Club",
    bar: "Bar",
    stadium: "Stadium / Arena",
    event_space: "Event space",
    restaurant: "Restaurant",
    corporate: "Corporate",
    retail: "Retail",
    other: "Other",
  };
  return labels[t] ?? t;
}

function RequestCard({ 
  r, 
  index, 
  venue,
  onAccept 
}: { 
  r: VenueRequest; 
  index: number;
  venue: Venue;
  onAccept: (request: VenueRequest) => void;
}) {
  const rate = r.rateOffered != null ? `£${(r.rateOffered / 100).toFixed(2)}/hr` : null;
  
  // Calculate estimated earnings
  const calculateEarnings = () => {
    if (!r.rateOffered || !r.start || !r.end) return null;
    const start = new Date(r.start);
    const end = new Date(r.end);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    return (hours * r.rateOffered / 100).toFixed(2);
  };
  
  const earnings = calculateEarnings();
  
  return (
    <FadeInView delay={index * 50}>
      <TouchableOpacity 
        style={styles.requestCard}
        onPress={() => onAccept(r)}
        activeOpacity={0.8}
      >
        <View style={styles.requestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestTitle}>{r.title}</Text>
            <Text style={styles.requestMeta}>
              {formatDate(r.start)}
              {r.end ? ` · ${formatTimeRange(r.start, r.end)}` : ""}
            </Text>
          </View>
          {earnings && (
            <View style={styles.earningsBadge}>
              <Text style={styles.earningsText}>£{earnings}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.requestDetails}>
          <Text style={styles.requestGuards}>
            {r.guardsCount} guard{r.guardsCount !== 1 ? "s" : ""} needed
            {rate ? ` · ${rate}` : ""}
          </Text>
          {r.certsRequired && r.certsRequired.length > 0 && (
            <Text style={styles.requestCerts}>Certs: {r.certsRequired.join(", ")}</Text>
          )}
        </View>
        
        <View style={styles.acceptRow}>
          <Text style={styles.tapToAccept}>Tap to view & accept →</Text>
        </View>
      </TouchableOpacity>
    </FadeInView>
  );
}

export default function VenueDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const venue = idStr ? getVenueById(idStr) : undefined;
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VenueRequest | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [personnelId, setPersonnelId] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
    if (!supabase || !idStr) return;
    supabase
      .from("venues")
      .select("owner_id")
      .eq("id", idStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.owner_id) setOwnerId(data.owner_id);
      });
  }, [idStr]);

  const loadUserData = async () => {
    try {
      const result = await getProfileIdAndRole(supabase);
      if (result?.profileId) {
        const pId = await getPersonnelId(supabase, result.profileId);
        setPersonnelId(pId);
      }
    } catch (e) {
      // Not logged in
    }
  };

  const handleAcceptJob = async () => {
    if (!selectedRequest || !personnelId || !venue) return;
    
    setAccepting(true);
    safeHaptic("medium");
    Vibration.vibrate(100);

    try {
      // Create a booking/application for this shift
      const { error } = await supabase.from("shift_applications").insert({
        venue_id: idStr,
        personnel_id: personnelId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
        shift_date: selectedRequest.start,
        notes: `Applied for: ${selectedRequest.title}`,
      });

      if (error) throw error;

      setAccepted(true);
      safeHaptic("success");
      Vibration.vibrate([0, 100, 50, 100]);

      // Close modal after delay
      setTimeout(() => {
        setSelectedRequest(null);
        setAccepted(false);
        Alert.alert(
          "You're booked! ✅",
          `You've accepted the ${selectedRequest.title} shift at ${venue.name}. Check your Account tab for details.`,
          [{ text: "OK" }]
        );
      }, 2000);
    } catch (error: any) {
      safeHaptic("error");
      Alert.alert("Error", error.message || "Failed to accept job. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const calculateEarnings = (r: VenueRequest) => {
    if (!r.rateOffered || !r.start || !r.end) return { hours: 0, total: 0, rate: 0 };
    const start = new Date(r.start);
    const end = new Date(r.end);
    let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    const rate = r.rateOffered / 100;
    const total = hours * rate;
    return { hours: Math.round(hours * 10) / 10, total, rate };
  };

  if (!venue) {
    return (
      <GradientBackground>
        <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
          <FadeInView>
            <GlassCard style={styles.errorCard}>
              <Text style={styles.error}>Venue not found.</Text>
              <GlowButton onPress={() => router.back()}>
                <Text style={styles.backBtnText}>Go back</Text>
              </GlowButton>
            </GlassCard>
          </FadeInView>
        </View>
      </GradientBackground>
    );
  }

  const totalGuards = venue.openRequests.reduce((s, r) => s + r.guardsCount, 0);

  return (
    <GradientBackground>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
        <BackButton />
        
        <FadeInView>
          <GlassCard>
            <Text style={styles.name}>{venue.name}</Text>

            {venue.venueType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{VenueTypeLabel(venue.venueType)}</Text>
              </View>
            )}

            {venue.address && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{venue.address}</Text>
              </View>
            )}

            {venue.description && (
              <View style={styles.descSection}>
                <Text style={styles.descLabel}>About the venue</Text>
                <Text style={styles.desc}>{venue.description}</Text>
              </View>
            )}

            {venue.capacity != null && (
              <Text style={styles.capacity}>Capacity: {venue.capacity.toLocaleString()}</Text>
            )}

            {ownerId && (
              <View style={styles.messageBtnWrap}>
                <GlowButton
                  onPress={() => router.push({ pathname: "/chat/start", params: { other: ownerId } })}
                >
                  <Text style={styles.messageBtnText}>Message venue</Text>
                </GlowButton>
              </View>
            )}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>What we&apos;re looking for</Text>
            <Text style={styles.sectionMeta}>
              {venue.openRequests.length} open request{venue.openRequests.length !== 1 ? "s" : ""} ·{" "}
              {totalGuards} guard{totalGuards !== 1 ? "s" : ""} needed
            </Text>
            {venue.openRequests.map((r, index) => (
              <RequestCard 
                key={r.id} 
                r={r} 
                index={index} 
                venue={venue}
                onAccept={(request) => setSelectedRequest(request)}
              />
            ))}
          </View>
        </FadeInView>
      </ScrollView>

      {/* Accept Job Modal */}
      <Modal
        visible={!!selectedRequest}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            {accepted ? (
              // Success state
              <View style={styles.successContainer}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>You're Booked!</Text>
                <Text style={styles.successSubtitle}>
                  {selectedRequest?.title} at {venue.name}
                </Text>
              </View>
            ) : selectedRequest ? (
              // Accept form
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Accept Job</Text>
                  <View style={{ width: 30 }} />
                </View>

                {/* Venue & Shift Info */}
                <View style={styles.jobInfo}>
                  <Text style={styles.jobVenue}>{venue.name}</Text>
                  <Text style={styles.jobAddress}>📍 {venue.address}</Text>
                </View>

                <View style={styles.shiftInfo}>
                  <Text style={styles.shiftTitle}>{selectedRequest.title}</Text>
                  <Text style={styles.shiftTime}>
                    {formatDate(selectedRequest.start)}
                    {selectedRequest.end ? ` · ${formatTimeRange(selectedRequest.start, selectedRequest.end)}` : ""}
                  </Text>
                </View>

                {/* Earnings Breakdown */}
                {(() => {
                  const { hours, total, rate } = calculateEarnings(selectedRequest);
                  return (
                    <View style={styles.earningsBreakdown}>
                      <View style={styles.earningsItem}>
                        <Text style={styles.earningsLabel}>Hourly Rate</Text>
                        <Text style={styles.earningsValue}>£{rate.toFixed(2)}/hr</Text>
                      </View>
                      <View style={styles.earningsItem}>
                        <Text style={styles.earningsLabel}>Duration</Text>
                        <Text style={styles.earningsValue}>{hours} hours</Text>
                      </View>
                      <View style={styles.earningsDivider} />
                      <View style={styles.earningsItem}>
                        <Text style={styles.totalLabel}>Total Earnings</Text>
                        <Text style={styles.totalValue}>£{total.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Requirements */}
                {selectedRequest.certsRequired && selectedRequest.certsRequired.length > 0 && (
                  <View style={styles.requirements}>
                    <Text style={styles.requirementsTitle}>Requirements</Text>
                    <Text style={styles.requirementsText}>
                      {selectedRequest.certsRequired.join(", ")}
                    </Text>
                  </View>
                )}

                {/* Spots remaining */}
                <View style={styles.spotsRemaining}>
                  <Text style={styles.spotsText}>
                    {selectedRequest.guardsCount} spot{selectedRequest.guardsCount !== 1 ? "s" : ""} available
                  </Text>
                </View>

                {/* Accept Button */}
                {personnelId ? (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={handleAcceptJob}
                    disabled={accepting}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[colors.accent, "#1fa89e"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.acceptGradient}
                    >
                      <Text style={styles.acceptButtonText}>
                        {accepting ? "Accepting..." : "Accept Job →"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => {
                      setSelectedRequest(null);
                      router.push("/login");
                    }}
                  >
                    <Text style={styles.loginButtonText}>Log in to Accept</Text>
                  </TouchableOpacity>
                )}

                {/* Decline */}
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Text style={styles.declineText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  errorCard: { alignItems: "center", paddingVertical: spacing.xxl },
  error: { ...typography.body, color: colors.text, marginBottom: spacing.lg },
  backBtnText: { ...typography.titleCard, color: colors.text },
  name: { ...typography.display, fontSize: 22, color: colors.text },
  typeBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  typeBadgeText: { ...typography.caption, color: colors.accent, fontWeight: "500" },
  infoRow: { marginTop: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  value: { ...typography.body, color: colors.textSecondary },
  descSection: { marginTop: spacing.lg },
  descLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  desc: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  capacity: { ...typography.label, color: colors.textMuted, marginTop: spacing.lg },
  messageBtnWrap: { marginTop: spacing.xl },
  messageBtnText: { ...typography.body, fontWeight: "600", color: colors.text },
  requestsSection: { marginTop: spacing.xl },
  sectionTitle: { ...typography.titleCard, color: colors.text },
  sectionMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  requestCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.glass,
    marginBottom: spacing.md,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  requestTitle: { ...typography.titleCard, color: colors.text },
  requestMeta: { ...typography.label, color: colors.textMuted, marginTop: spacing.xs },
  requestDetails: { marginTop: spacing.sm },
  requestGuards: { ...typography.label, color: colors.accent, fontWeight: "500" },
  requestCerts: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  requestDesc: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  earningsBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  earningsText: {
    ...typography.title,
    color: colors.accent,
    fontSize: 18,
  },
  acceptRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  tapToAccept: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textMuted,
    padding: spacing.sm,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
  },
  jobInfo: {
    marginBottom: spacing.md,
  },
  jobVenue: {
    ...typography.title,
    color: colors.text,
    fontSize: 20,
  },
  jobAddress: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  shiftInfo: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  shiftTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  earningsBreakdown: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  earningsItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  earningsLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  earningsValue: {
    ...typography.body,
    color: colors.text,
  },
  earningsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  totalValue: {
    ...typography.title,
    color: colors.accent,
    fontSize: 24,
  },
  requirements: {
    marginBottom: spacing.md,
  },
  requirementsTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  requirementsText: {
    ...typography.body,
    color: colors.text,
  },
  spotsRemaining: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  spotsText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "500",
  },
  acceptButton: {
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  acceptGradient: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  acceptButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    fontSize: 18,
  },
  loginButton: {
    paddingVertical: spacing.lg,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginButtonText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  declineButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  declineText: {
    ...typography.body,
    color: colors.textMuted,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
});
