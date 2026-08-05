import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { colors, typography, spacing, radius } from "../theme";
import { supabase } from "../lib/supabase";
import { getProfileIdAndRole } from "../lib/auth";
import { safeHaptic } from "../lib/haptics";
import { SlideInView, AnimatedCard } from "../components/ui/AnimatedComponents";
import { GuestGate } from "../components/auth/GuestGate";

interface Document {
  id: string;
  document_type: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  reference_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  verification_status: string;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: "sia_license", label: "SIA License", icon: "🛡️" },
  { value: "sia_cctv", label: "SIA CCTV", icon: "📹" },
  { value: "sia_door", label: "SIA Door Supervisor", icon: "🚪" },
  { value: "dbs_check", label: "DBS Check", icon: "✅" },
  { value: "first_aid", label: "First Aid", icon: "🏥" },
  { value: "passport", label: "Passport", icon: "🛂" },
  { value: "driving_license", label: "Driving License", icon: "🚗" },
  { value: "training_cert", label: "Training Certificate", icon: "🎓" },
  { value: "other", label: "Other", icon: "📄" },
];

/**
 * Documents are grouped into plain-English categories so guards always know
 * exactly what to upload and what's still missing.
 */
const DOC_CATEGORIES: {
  id: string;
  title: string;
  hint: string;
  icon: string;
  types: string[];
  /** Docs we actively prompt for if missing. Satisfied by ANY of `types`. */
  recommended: { types: string[]; label: string; addType: string }[];
}[] = [
  {
    id: "sia",
    title: "SIA Licences",
    hint: "Your licence to work. Venues check these before booking you.",
    icon: "🛡️",
    types: ["sia_license", "sia_door", "sia_cctv"],
    recommended: [
      { types: ["sia_license", "sia_door", "sia_cctv"], label: "SIA Licence", addType: "sia_license" },
    ],
  },
  {
    id: "training",
    title: "First Aid & Training",
    hint: "Certificates that win you better-paid shifts.",
    icon: "🏥",
    types: ["first_aid", "training_cert"],
    recommended: [
      { types: ["first_aid"], label: "First Aid certificate", addType: "first_aid" },
    ],
  },
  {
    id: "identity",
    title: "ID & Vetting",
    hint: "Proves who you are and your right to work.",
    icon: "🪪",
    types: ["passport", "driving_license", "dbs_check"],
    recommended: [
      { types: ["passport", "driving_license"], label: "Photo ID (passport or driving licence)", addType: "passport" },
      { types: ["dbs_check"], label: "DBS Check", addType: "dbs_check" },
    ],
  },
  {
    id: "other",
    title: "Other Documents",
    hint: "Anything else worth showing venues.",
    icon: "📄",
    types: ["other"],
    recommended: [],
  },
];

export default function DocumentsScreen() {
  return (
    <GuestGate feature="documents" redirectAfter="/documents">
      <DocumentsScreenContent />
    </GuestGate>
  );
}

function DocumentsScreenContent() {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [title, setTitle] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const result = await getProfileIdAndRole(supabase, user.id);
    if (result?.profileId) {
      setUserId(result.profileId);
      await loadDocuments(result.profileId);
    }
    setLoading(false);
  };

  const loadDocuments = async (uId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", uId)
      .order("created_at", { ascending: false });

    if (data) {
      setDocuments(data);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (userId) await loadDocuments(userId);
    setRefreshing(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
        if (!title) {
          setTitle(result.assets[0].name.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || !title || !userId) return;

    if (!supabase) return;
    setUploading(true);
    safeHaptic("medium");

    try {
      // Upload to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Save document record
      const { error: insertError } = await supabase.from("user_documents").insert({
        user_id: userId,
        document_type: selectedType,
        title,
        file_url: publicUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.mimeType,
        reference_number: referenceNumber || null,
      });

      if (insertError) throw insertError;

      safeHaptic("success");
      setShowUploadModal(false);
      resetForm();
      await loadDocuments(userId);
    } catch (error: any) {
      safeHaptic("error");
      Alert.alert("Error", error.message || "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (doc: Document) => {
    Alert.alert("Delete Document", `Delete "${doc.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!supabase) return;
          await supabase.from("user_documents").delete().eq("id", doc.id);
          if (userId) await loadDocuments(userId);
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedType("");
    setTitle("");
    setReferenceNumber("");
    setSelectedFile(null);
    setModalCategory(null);
  };

  /** Open the upload sheet, optionally scoped to a category / preset type. */
  const openUpload = (categoryId?: string, presetType?: string) => {
    safeHaptic("light");
    setModalCategory(categoryId ?? null);
    if (presetType) setSelectedType(presetType);
    setShowUploadModal(true);
  };

  const getTypeInfo = (type: string) => {
    return DOCUMENT_TYPES.find((t) => t.value === type) || { label: type, icon: "📄" };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" };
      case "pending":
        return { bg: "rgba(234, 179, 8, 0.2)", text: "#eab308" };
      case "rejected":
        return { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" };
      default:
        return { bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasDocOfTypes = (types: string[]) =>
    documents.some((d) => types.includes(d.document_type));

  // Essentials checklist progress across all categories.
  const allRecommended = DOC_CATEGORIES.flatMap((c) => c.recommended);
  const satisfiedCount = allRecommended.filter((r) => hasDocOfTypes(r.types)).length;

  const renderDocCard = (doc: Document, index: number) => {
    const typeInfo = getTypeInfo(doc.document_type);
    const statusColors = getStatusColor(doc.verification_status);
    const expired = isExpired(doc.expiry_date);

    return (
      <SlideInView key={doc.id} delay={index * 50}>
        <View style={[styles.docCard, expired && styles.docCardExpired]}>
          <View style={styles.docHeader}>
            <Text style={styles.docIcon}>{typeInfo.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.docType}>{typeInfo.label}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {expired ? "Expired" : doc.verification_status}
              </Text>
            </View>
          </View>

          {doc.reference_number && (
            <Text style={styles.refNumber}>Ref: {doc.reference_number}</Text>
          )}

          <View style={styles.docMeta}>
            {doc.expiry_date && (
              <Text style={[styles.metaText, expired && { color: "#ef4444" }]}>
                Expires: {new Date(doc.expiry_date).toLocaleDateString("en-GB")}
              </Text>
            )}
            <Text style={styles.metaText}>{formatFileSize(doc.file_size)}</Text>
          </View>

          <View style={styles.docActions}>
            <TouchableOpacity style={styles.viewBtn}>
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(doc)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideInView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openUpload()}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Essentials progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Get verified</Text>
            <Text style={styles.progressCount}>
              {satisfiedCount}/{allRecommended.length} essentials
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.round(
                    (satisfiedCount / Math.max(allRecommended.length, 1)) * 100
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressHint}>
            {satisfiedCount === allRecommended.length
              ? "All essentials uploaded — venues can book you with confidence."
              : "Upload the essentials below to unlock more (and better-paid) shifts."}
          </Text>
        </View>

        {/* Categorised sections */}
        {DOC_CATEGORIES.map((category) => {
          const categoryDocs = documents.filter((d) =>
            category.types.includes(d.document_type)
          );
          const missing = category.recommended.filter((r) => !hasDocOfTypes(r.types));
          if (category.id === "other" && categoryDocs.length === 0) {
            // Keep "Other" minimal — just a quiet add row.
            return (
              <View key={category.id} style={styles.categorySection}>
                <TouchableOpacity
                  style={styles.otherAddRow}
                  onPress={() => openUpload(category.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.otherAddText}>
                    {category.icon} Add another document
                  </Text>
                  <Text style={styles.otherAddPlus}>+</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryHint}>{category.hint}</Text>
                </View>
                <TouchableOpacity
                  style={styles.categoryAddBtn}
                  onPress={() => openUpload(category.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.categoryAddText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {categoryDocs.map((doc, index) => renderDocCard(doc, index))}

              {/* Prompts for missing essentials */}
              {missing.map((r) => (
                <TouchableOpacity
                  key={r.label}
                  style={styles.missingRow}
                  onPress={() => openUpload(category.id, r.addType)}
                  activeOpacity={0.7}
                >
                  <View style={styles.missingCircle}>
                    <Text style={styles.missingCircleText}>+</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingLabel}>Add your {r.label}</Text>
                    <Text style={styles.missingSub}>Tap to upload</Text>
                  </View>
                  <Text style={styles.missingChevron}>›</Text>
                </TouchableOpacity>
              ))}

              {categoryDocs.length === 0 && missing.length === 0 && (
                <Text style={styles.categoryEmptyText}>Nothing uploaded yet.</Text>
              )}
            </View>
          );
        })}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.modalTitle}>Upload Document</Text>

            {/* Document Type */}
            <Text style={styles.inputLabel}>Document Type *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
            >
              {DOCUMENT_TYPES.filter((type) => {
                if (!modalCategory) return true;
                const cat = DOC_CATEGORIES.find((c) => c.id === modalCategory);
                return cat ? cat.types.includes(type.value) : true;
              }).map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeBtn,
                    selectedType === type.value && styles.typeBtnActive,
                  ]}
                  onPress={() => {
                    safeHaptic("selection");
                    setSelectedType(type.value);
                  }}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text
                    style={[
                      styles.typeLabel,
                      selectedType === type.value && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* File Picker */}
            <Text style={styles.inputLabel}>File *</Text>
            <TouchableOpacity
              style={styles.filePicker}
              onPress={handlePickDocument}
            >
              {selectedFile ? (
                <View style={styles.selectedFile}>
                  <Text style={styles.fileIcon}>📄</Text>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.filePickerEmpty}>
                  <Text style={styles.uploadIcon}>📤</Text>
                  <Text style={styles.uploadText}>Tap to select file</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. SIA Door Supervisor License"
              placeholderTextColor={colors.textMuted}
            />

            {/* Reference Number */}
            <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="e.g. 1234-5678-9012"
              placeholderTextColor={colors.textMuted}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!selectedFile || !selectedType || !title) && styles.submitBtnDisabled,
                ]}
                onPress={handleUpload}
                disabled={!selectedFile || !selectedType || !title || uploading}
              >
                <Text style={styles.submitBtnText}>
                  {uploading ? "Uploading..." : "Upload"}
                </Text>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  addBtnText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  uploadBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  uploadBtnText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  progressCount: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: "#22c55e",
  },
  progressHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  categorySection: {
    marginBottom: spacing.xl,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  categoryHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  categoryAddBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent + "60",
  },
  categoryAddText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  missingCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  missingCircleText: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: "600",
  },
  missingLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  missingSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  missingChevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
  categoryEmptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  otherAddRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.md,
  },
  otherAddText: {
    ...typography.body,
    color: colors.textMuted,
  },
  otherAddPlus: {
    fontSize: 20,
    color: colors.accent,
  },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  docCardExpired: {
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  docIcon: {
    fontSize: 28,
  },
  docTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },
  docType: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: "500",
  },
  refNumber: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  docMeta: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  docActions: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  viewBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  viewBtnText: {
    ...typography.caption,
    color: colors.text,
  },
  deleteBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  deleteBtnText: {
    ...typography.caption,
    color: "#ef4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "90%",
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  typeScroll: {
    marginBottom: spacing.sm,
  },
  typeBtn: {
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
    minWidth: 80,
  },
  typeBtnActive: {
    backgroundColor: colors.accent,
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  typeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
  },
  typeLabelActive: {
    color: colors.text,
  },
  filePicker: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  filePickerEmpty: {
    alignItems: "center",
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  uploadText: {
    ...typography.body,
    color: colors.textMuted,
  },
  selectedFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.text,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
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
