import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole, getVenueId, getAgencyId } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView } from "../components/ui/AnimatedComponents";

interface Booking {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  guards_count: number;
  rate: number;
  status: string;
  notes: string;
  venue_name?: string;
  personnel_name?: string;
}

export default function BookingManageScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form
  const [editForm, setEditForm] = useState({
    shift_date: "",
    start_time: "",
    end_time: "",
    guards_count: "1",
    rate: "",
    notes: "",
  });

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    setLoading(true);
    try {
      const { role: userRole } = await getProfileIdAndRole(supabase);
      setRole(userRole || "");

      if (bookingId) {
        const { data } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        if (data) {
          setBooking(data);
          setEditForm({
            shift_date: data.shift_date || "",
            start_time: data.start_time || "",
            end_time: data.end_time || "",
            guards_count: data.guards_count?.toString() || "1",
            rate: data.rate?.toString() || "",
            notes: data.notes || "",
          });
        }
      }
    } catch (error) {
      console.error("Error loading booking:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!booking) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          shift_date: editForm.shift_date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          guards_count: parseInt(editForm.guards_count) || 1,
          rate: parseInt(editForm.rate) || 0,
          notes: editForm.notes,
        })
        .eq("id", booking.id);

      if (error) throw error;

      safeHaptic("success");
      setIsEditing(false);
      loadBooking();
      Alert.alert("Success", "Booking updated successfully!");
    } catch (error) {
      console.error("Error saving booking:", error);
      safeHaptic("error");
      Alert.alert("Error", "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    Alert.alert(
      "Confirm",
      `Are you sure you want to ${newStatus === "confirmed" ? "confirm" : newStatus === "cancelled" ? "cancel" : "update"} this booking?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("bookings")
                .update({ status: newStatus })
                .eq("id", booking.id);

              if (error) throw error;

              safeHaptic("success");
              loadBooking();
              Alert.alert("Success", `Booking ${newStatus}`);
            } catch (error) {
              console.error("Error updating status:", error);
              safeHaptic("error");
              Alert.alert("Error", "Failed to update booking status");
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!booking) return;

    Alert.alert(
      "Delete Booking",
      "Are you sure you want to delete this booking? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("bookings")
                .delete()
                .eq("id", booking.id);

              if (error) throw error;

              safeHaptic("success");
              Alert.alert("Deleted", "Booking has been deleted");
              router.back();
            } catch (error) {
              console.error("Error deleting booking:", error);
              safeHaptic("error");
              Alert.alert("Error", "Failed to delete booking");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "N/A";
    return timeStr.slice(0, 5);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "cancelled":
        return "#EF4444";
      case "completed":
        return "#3B82F6";
      default:
        return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Booking not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Booking Details</Text>
        {!isEditing && booking.status === "pending" && (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.editBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <SlideInView delay={0}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Text>
            </View>
          </View>
        </SlideInView>

        {/* Booking Details Card */}
        <SlideInView delay={100}>
          <View style={styles.card}>
            {isEditing ? (
              // Edit Mode
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.shift_date}
                    onChangeText={(text) => setEditForm((prev) => ({ ...prev, shift_date: text }))}
                    placeholder="2024-12-31"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Start Time</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.start_time}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, start_time: text }))}
                      placeholder="21:00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>End Time</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.end_time}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, end_time: text }))}
                      placeholder="03:00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Guards</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.guards_count}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, guards_count: text }))}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Rate (pence)</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.rate}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, rate: text }))}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editForm.notes}
                    onChangeText={(text) => setEditForm((prev) => ({ ...prev, notes: text }))}
                    placeholder="Any special requirements..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              // View Mode
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>📅 Date</Text>
                  <Text style={styles.detailValue}>{formatDate(booking.shift_date)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>⏰ Time</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>👥 Guards</Text>
                  <Text style={styles.detailValue}>{booking.guards_count}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>💷 Rate</Text>
                  <Text style={styles.detailValue}>
                    £{((booking.rate || 0) / 100).toFixed(2)}/hr
                  </Text>
                </View>

                {booking.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>📝 Notes</Text>
                    <Text style={styles.notesText}>{booking.notes}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </SlideInView>

        {/* Action Buttons */}
        {!isEditing && (
          <SlideInView delay={200}>
            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Actions</Text>

              {booking.status === "pending" && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.confirmButton]}
                    onPress={() => handleStatusChange("confirmed")}
                  >
                    <Text style={styles.actionButtonText}>✓ Confirm Booking</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => handleStatusChange("cancelled")}
                  >
                    <Text style={styles.actionButtonText}>✕ Cancel Booking</Text>
                  </TouchableOpacity>
                </>
              )}

              {booking.status === "confirmed" && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.completeButton]}
                    onPress={() => handleStatusChange("completed")}
                  >
                    <Text style={styles.actionButtonText}>✓ Mark as Completed</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => handleStatusChange("cancelled")}
                  >
                    <Text style={styles.actionButtonText}>✕ Cancel Booking</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>🗑 Delete Booking</Text>
              </TouchableOpacity>
            </View>
          </SlideInView>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  editBtn: {
    padding: spacing.sm,
  },
  editText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },
  cancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  backButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.body,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  notesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  notesLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  notesText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionsTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  confirmButton: {
    backgroundColor: "#10B981",
  },
  cancelButton: {
    backgroundColor: "#EF4444",
  },
  completeButton: {
    backgroundColor: "#3B82F6",
  },
  deleteButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#EF4444",
    marginTop: spacing.md,
  },
  actionButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  deleteButtonText: {
    ...typography.body,
    color: "#EF4444",
    fontWeight: "600",
  },
});
