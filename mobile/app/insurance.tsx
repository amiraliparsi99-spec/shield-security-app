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
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView } from "../components/ui/AnimatedComponents";

interface InsuranceRecord {
  id: string;
  provider_name: string;
  policy_number: string;
  coverage_type: string;
  coverage_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  document_url?: string;
  created_at: string;
}

const COVERAGE_TYPES = [
  "Public Liability",
  "Employer's Liability",
  "Professional Indemnity",
  "Personal Accident",
  "Combined",
];

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<InsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [newRecord, setNewRecord] = useState({
    provider_name: "",
    policy_number: "",
    coverage_type: "Public Liability",
    coverage_amount: "",
    start_date: "",
    end_date: "",
  });
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const { profileId } = await getProfileIdAndRole(supabase);
      setUserId(profileId);

      if (profileId) {
        const { data } = await supabase
          .from("insurance_records")
          .select("*")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false });

        if (data) {
          setRecords(data);
        }
      }
    } catch (error) {
      console.error("Error loading insurance records:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  }, []);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedFile(result.assets[0]);
        safeHaptic("success");
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (!newRecord.provider_name || !newRecord.policy_number) {
      Alert.alert("Error", "Please fill in provider name and policy number");
      return;
    }

    setUploading(true);
    try {
      let documentUrl = null;

      // Upload document if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from("insurance")
          .upload(fileName, blob);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("insurance")
            .getPublicUrl(fileName);
          documentUrl = urlData.publicUrl;
        }
      }

      // Insert record
      const { error } = await supabase.from("insurance_records").insert({
        user_id: userId,
        provider_name: newRecord.provider_name,
        policy_number: newRecord.policy_number,
        coverage_type: newRecord.coverage_type,
        coverage_amount: parseInt(newRecord.coverage_amount) || 0,
        start_date: newRecord.start_date || null,
        end_date: newRecord.end_date || null,
        document_url: documentUrl,
        status: "pending",
      });

      if (error) throw error;

      safeHaptic("success");
      setShowAddModal(false);
      setNewRecord({
        provider_name: "",
        policy_number: "",
        coverage_type: "Public Liability",
        coverage_amount: "",
        start_date: "",
        end_date: "",
      });
      setSelectedFile(null);
      loadRecords();
      Alert.alert("Success", "Insurance record added for verification");
    } catch (error) {
      console.error("Error adding insurance:", error);
      safeHaptic("error");
      Alert.alert("Error", "Failed to add insurance record");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (record: InsuranceRecord) => {
    Alert.alert(
      "Delete Record",
      "Are you sure you want to delete this insurance record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("insurance_records").delete().eq("id", record.id);
              safeHaptic("success");
              loadRecords();
            } catch (error) {
              console.error("Error deleting record:", error);
              Alert.alert("Error", "Failed to delete record");
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "rejected":
        return "#EF4444";
      case "expired":
        return "#6B7280";
      default:
        return colors.textMuted;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number) => {
    return `£${(amount / 100).toLocaleString()}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Insurance</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setShowAddModal(true);
            safeHaptic("light");
          }}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Info Card */}
        <SlideInView delay={0}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🛡️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Insurance Verification</Text>
              <Text style={styles.infoText}>
                Upload your insurance documents for verification. Verified insurance builds trust with venues.
              </Text>
            </View>
          </View>
        </SlideInView>

        {/* Records List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Insurance Records</Text>
            <Text style={styles.emptyText}>
              Add your insurance details to get verified
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {records.map((record, index) => (
              <SlideInView key={record.id} delay={index * 100}>
                <View style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <View>
                      <Text style={styles.providerName}>{record.provider_name}</Text>
                      <Text style={styles.policyNumber}>Policy: {record.policy_number}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(record.status) + "20" },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                        {record.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recordDetails}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailValue}>{record.coverage_type}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Coverage</Text>
                      <Text style={styles.detailValue}>{formatAmount(record.coverage_amount)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Expires</Text>
                      <Text style={styles.detailValue}>{formatDate(record.end_date)}</Text>
                    </View>
                  </View>

                  <View style={styles.recordActions}>
                    {record.document_url && (
                      <TouchableOpacity style={styles.viewBtn}>
                        <Text style={styles.viewBtnText}>📄 View Document</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(record)}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </SlideInView>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Insurance</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.label}>Insurance Provider</Text>
                <TextInput
                  style={styles.input}
                  value={newRecord.provider_name}
                  onChangeText={(text) => setNewRecord((prev) => ({ ...prev, provider_name: text }))}
                  placeholder="e.g. Hiscox, AXA"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Policy Number</Text>
                <TextInput
                  style={styles.input}
                  value={newRecord.policy_number}
                  onChangeText={(text) => setNewRecord((prev) => ({ ...prev, policy_number: text }))}
                  placeholder="Enter policy number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Coverage Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipContainer}>
                    {COVERAGE_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.chip,
                          newRecord.coverage_type === type && styles.chipSelected,
                        ]}
                        onPress={() => {
                          safeHaptic("selection");
                          setNewRecord((prev) => ({ ...prev, coverage_type: type }));
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            newRecord.coverage_type === type && styles.chipTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Coverage Amount (£)</Text>
                <TextInput
                  style={styles.input}
                  value={newRecord.coverage_amount}
                  onChangeText={(text) => setNewRecord((prev) => ({ ...prev, coverage_amount: text }))}
                  placeholder="e.g. 1000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Start Date</Text>
                  <TextInput
                    style={styles.input}
                    value={newRecord.start_date}
                    onChangeText={(text) => setNewRecord((prev) => ({ ...prev, start_date: text }))}
                    placeholder="2024-01-01"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>End Date</Text>
                  <TextInput
                    style={styles.input}
                    value={newRecord.end_date}
                    onChangeText={(text) => setNewRecord((prev) => ({ ...prev, end_date: text }))}
                    placeholder="2025-01-01"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Insurance Document</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
                  <Text style={styles.uploadBtnText}>
                    {selectedFile ? `📄 ${selectedFile.name}` : "📎 Select Document (PDF or Image)"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.submitBtnText}>Add Insurance Record</Text>
              )}
            </TouchableOpacity>
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
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  addBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  infoIcon: {
    fontSize: 32,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  recordsList: {
    gap: spacing.md,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  providerName: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  policyNumber: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  recordDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailItem: {
    alignItems: "center",
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  recordActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewBtn: {
    paddingVertical: spacing.sm,
  },
  viewBtnText: {
    ...typography.body,
    color: colors.accent,
    fontSize: 13,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
  },
  modalClose: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalBody: {
    padding: spacing.lg,
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
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  chipContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  uploadBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    borderStyle: "dashed",
  },
  uploadBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
});
