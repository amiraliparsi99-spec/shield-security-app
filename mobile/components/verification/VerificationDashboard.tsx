import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

interface VerificationDashboardProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
}

export function VerificationDashboard({ ownerType, ownerId }: VerificationDashboardProps) {
  const [verification, setVerification] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personnelData, setPersonnelData] = useState<any>(null);
  const [editingSIA, setEditingSIA] = useState(false);
  const [siaNumber, setSiaNumber] = useState("");
  const [siaExpiry, setSiaExpiry] = useState("");
  const [savingSIA, setSavingSIA] = useState(false);

  useEffect(() => {
    loadData();
  }, [ownerType, ownerId]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error("Supabase not configured");
      }

      // Load personnel data to get SIA info
      if (ownerType === "personnel") {
        const { data: pData } = await supabase
          .from("personnel")
          .select("sia_license_number, sia_expiry_date, display_name, city, certs")
          .eq("id", ownerId)
          .single();
        
        setPersonnelData(pData);
        if (pData) {
          setSiaNumber(pData.sia_license_number || "");
          setSiaExpiry(pData.sia_expiry_date || "");
        }
      }

      // Try to load verification status (may not exist)
      const { data: verificationData } = await supabase
        .from("verifications")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .maybeSingle();

      // Try to load documents (may not exist)
      const { data: documentsData } = await supabase
        .from("verification_documents")
        .select("*")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      setVerification(verificationData);
      setDocuments(documentsData || []);
    } catch (err: any) {
      console.error("Error loading verification data:", err);
      // Don't show error for missing tables - just continue with defaults
    } finally {
      setLoading(false);
    }
  }

  async function saveSIADetails() {
    if (!supabase) return;
    
    setSavingSIA(true);
    try {
      const { error } = await supabase
        .from("personnel")
        .update({
          sia_license_number: siaNumber || null,
          sia_expiry_date: siaExpiry || null,
        })
        .eq("id", ownerId);

      if (error) throw error;
      
      setEditingSIA(false);
      Alert.alert("Saved", "Your SIA details have been updated.");
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save SIA details");
    } finally {
      setSavingSIA(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading verification data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Calculate completion status
  const hasSIA = !!personnelData?.sia_license_number;
  const completedSteps = [hasSIA].filter(Boolean).length;
  const totalSteps = ownerType === "personnel" ? 4 : 3;

  return (
    <View style={styles.container}>
      {/* Progress Overview */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressIcon}>
            {ownerType === "personnel" ? "🛡️" : "🏛️"}
          </Text>
          <View style={styles.progressInfo}>
            <Text style={styles.progressTitle}>
              {ownerType === "personnel" ? "Security Professional" : "Agency"} Verification
            </Text>
            <Text style={styles.progressSubtitle}>
              {completedSteps} of {totalSteps} steps completed
            </Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${(completedSteps / totalSteps) * 100}%` }]} />
        </View>
      </View>

      {/* SIA License Section for Personnel */}
      {ownerType === "personnel" && (
        <View style={styles.siaCard}>
          <View style={styles.siaHeader}>
            <Text style={styles.siaTitle}>🪪 SIA License</Text>
            {hasSIA ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Added</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Required</Text>
              </View>
            )}
          </View>

          {editingSIA ? (
            <View style={styles.siaForm}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>License Number</Text>
                <TextInput
                  style={styles.input}
                  value={siaNumber}
                  onChangeText={setSiaNumber}
                  placeholder="e.g. 1234-5678-9012-3456"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  value={siaExpiry}
                  onChangeText={setSiaExpiry}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.siaButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setEditingSIA(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveBtn} 
                  onPress={saveSIADetails}
                  disabled={savingSIA}
                >
                  <Text style={styles.saveBtnText}>
                    {savingSIA ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.siaDisplay}>
              {hasSIA ? (
                <>
                  <Text style={styles.siaValue}>{personnelData.sia_license_number}</Text>
                  {personnelData.sia_expiry_date && (
                    <Text style={styles.siaExpiry}>
                      Expires: {new Date(personnelData.sia_expiry_date).toLocaleDateString("en-GB")}
                    </Text>
                  )}
                  <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => setEditingSIA(true)}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.siaHelp}>
                    Add your SIA license to get verified and start receiving booking requests.
                  </Text>
                  <TouchableOpacity 
                    style={styles.addBtn} 
                    onPress={() => setEditingSIA(true)}
                  >
                    <Text style={styles.addBtnText}>Add SIA License</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Verification Checklist */}
      <View style={styles.checklistCard}>
        <Text style={styles.sectionTitle}>Verification Checklist</Text>
        
        {ownerType === "personnel" ? (
          <>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>{hasSIA ? "✅" : "⬜"}</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>SIA License</Text>
                <Text style={styles.checkDesc}>Add your valid SIA license number</Text>
              </View>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>Photo ID</Text>
                <Text style={styles.checkDesc}>Passport, driving license, or ID card</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>Right to Work</Text>
                <Text style={styles.checkDesc}>Proof of UK work eligibility</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>Profile Photo</Text>
                <Text style={styles.checkDesc}>Professional headshot</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>Company Registration</Text>
                <Text style={styles.checkDesc}>Companies House certificate</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>Public Liability Insurance</Text>
                <Text style={styles.checkDesc}>Current insurance certificate</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>⬜</Text>
              <View style={styles.checkInfo}>
                <Text style={styles.checkTitle}>SIA ACS (Optional)</Text>
                <Text style={styles.checkDesc}>Approved Contractor Scheme certification</Text>
              </View>
              <Text style={styles.comingSoon}>Coming soon</Text>
            </View>
          </>
        )}
      </View>

      {/* Help Section */}
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>💡 Why verify?</Text>
        <Text style={styles.helpText2}>
          Verified {ownerType === "personnel" ? "security professionals" : "agencies"} are more likely to receive booking requests. 
          Venues trust verified profiles and you'll appear higher in search results.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.md },
  centered: { padding: spacing.xl, alignItems: "center" },
  loadingText: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.md },
  errorBox: {
    padding: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: "#ef444420",
    borderWidth: 1,
    borderColor: "#ef444440",
  },
  errorText: { ...typography.bodySmall, color: "#ef4444" },
  
  // Progress Card
  progressCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  progressIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  progressSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },

  // SIA Card
  siaCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  siaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  siaTitle: {
    ...typography.titleCard,
    color: colors.text,
  },
  siaDisplay: {
    paddingTop: spacing.sm,
  },
  siaValue: {
    ...typography.title,
    color: colors.accent,
    fontFamily: "monospace",
  },
  siaExpiry: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  siaHelp: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  siaForm: {
    gap: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  siaButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  saveBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  editBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  editBtnText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  addBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  addBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },

  // Badges
  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: "#10b98120",
  },
  verifiedText: { ...typography.caption, color: "#10b981", fontWeight: "600" },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: "#f59e0b20",
  },
  pendingText: { ...typography.caption, color: "#f59e0b", fontWeight: "600" },

  // Checklist Card
  checklistCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: { 
    ...typography.titleCard, 
    color: colors.text, 
    marginBottom: spacing.md,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  checkInfo: {
    flex: 1,
  },
  checkTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  checkDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  comingSoon: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  // Help Card
  helpCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  helpTitle: {
    ...typography.titleCard,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  helpText2: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
