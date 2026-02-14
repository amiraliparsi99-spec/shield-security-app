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

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [title, setTitle] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    const { profileId } = await getProfileIdAndRole(supabase);
    if (profileId) {
      setUserId(profileId);
      await loadDocuments(profileId);
    }
    setLoading(false);
  };

  const loadDocuments = async (uId: string) => {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowUploadModal(true)}
        >
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
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyText}>
              Upload your SIA license, certifications, and ID documents
            </Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => setShowUploadModal(true)}
            >
              <Text style={styles.uploadBtnText}>Upload Document</Text>
            </TouchableOpacity>
          </View>
        ) : (
          documents.map((doc, index) => {
            const typeInfo = getTypeInfo(doc.document_type);
            const statusColors = getStatusColor(doc.verification_status);
            const expired = isExpired(doc.expiry_date);

            return (
              <SlideInView key={doc.id} delay={index * 50}>
                <View
                  style={[
                    styles.docCard,
                    expired && styles.docCardExpired,
                  ]}
                >
                  <View style={styles.docHeader}>
                    <Text style={styles.docIcon}>{typeInfo.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docTitle}>{doc.title}</Text>
                      <Text style={styles.docType}>{typeInfo.label}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColors.bg },
                      ]}
                    >
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
                      <Text
                        style={[
                          styles.metaText,
                          expired && { color: "#ef4444" },
                        ]}
                      >
                        Expires: {new Date(doc.expiry_date).toLocaleDateString("en-GB")}
                      </Text>
                    )}
                    <Text style={styles.metaText}>
                      {formatFileSize(doc.file_size)}
                    </Text>
                  </View>

                  <View style={styles.docActions}>
                    <TouchableOpacity style={styles.viewBtn}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(doc)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </SlideInView>
            );
          })
        )}

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
              {DOCUMENT_TYPES.map((type) => (
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
