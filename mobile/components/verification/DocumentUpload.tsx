import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

interface DocumentUploadProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
  documentType: string;
  documentName: string;
  existingFileUrl?: string | null;
  existingMimeType?: string | null;
  /** Local file:// URI that survives step navigation (stored by parent) */
  localPreviewUri?: string | null;
  onUploadComplete?: (documentId: string, fileUrl: string, localUri: string) => void;
  onError?: (error: string) => void;
}

export function DocumentUpload({
  ownerType,
  ownerId,
  documentType,
  documentName,
  existingFileUrl,
  existingMimeType,
  localPreviewUri,
  onUploadComplete,
  onError,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [justPickedUri, setJustPickedUri] = useState<string | null>(null);
  const [justPickedMime, setJustPickedMime] = useState<string | null>(null);

  const hasFile = !!existingFileUrl || !!justPickedUri || !!localPreviewUri;

  const effectiveMime = justPickedMime || existingMimeType || "";
  const isPdf = effectiveMime === "application/pdf";

  // Pick the best available preview URI: prefer just-picked local, then parent-stored local, then remote
  const previewUri = justPickedUri || localPreviewUri || existingFileUrl || "";

  const pickDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant camera roll permissions to upload documents.");
        return;
      }

      Alert.alert(
        "Upload Document",
        "Choose how you want to upload your document",
        [
          { text: "Take Photo", onPress: () => pickImageFromCamera() },
          { text: "Choose from Library", onPress: () => pickImageFromLibrary() },
          { text: "Choose PDF", onPress: () => pickPDF() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } catch (error: any) {
      onError?.(error.message || "Failed to pick document");
    }
  };

  const pickImageFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant camera permissions to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, "image/jpeg", "jpg");
      }
    } catch (error: any) {
      onError?.(error.message || "Failed to take photo");
    }
  };

  const pickImageFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || "image/jpeg";
        const ext = asset.uri.split(".").pop() || "jpg";
        await uploadFile(asset.uri, mimeType, ext);
      }
    } catch (error: any) {
      onError?.(error.message || "Failed to pick image");
    }
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, "application/pdf", "pdf");
      }
    } catch (error: any) {
      onError?.(error.message || "Failed to pick PDF");
    }
  };

  const uploadFile = async (uri: string, mimeType: string, ext: string) => {
    if (!supabase) {
      onError?.("Supabase not configured");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(mimeType)) {
      onError?.("Invalid file type. Please upload PDF, JPG, or PNG files only.");
      return;
    }

    setUploading(true);
    setJustPickedUri(uri);
    setJustPickedMime(mimeType);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const maxSize = 10 * 1024 * 1024;
      if (blob.size > maxSize) {
        onError?.("File size too large. Maximum size is 10MB.");
        setJustPickedUri(null);
        setJustPickedMime(null);
        setUploading(false);
        return;
      }

      const fileName = `${ownerType}/${ownerId}/${documentType}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, blob, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("verification-documents")
        .getPublicUrl(fileName);

      const { data: existing } = await supabase
        .from("verification_documents")
        .select("id")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .eq("document_type", documentType)
        .maybeSingle();

      let documentData: { id: string };
      if (existing?.id) {
        const { data: updated, error: updateErr } = await supabase
          .from("verification_documents")
          .update({
            file_url: publicUrl,
            file_size: blob.size,
            mime_type: mimeType,
            document_name: documentName,
            status: "pending",
            verified_at: null,
            verified_by: null,
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        documentData = updated;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("verification_documents")
          .insert({
            owner_type: ownerType,
            owner_id: ownerId,
            document_type: documentType,
            document_name: documentName,
            file_url: publicUrl,
            file_size: blob.size,
            mime_type: mimeType,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        documentData = inserted;
      }

      // Pass the local URI to the parent so it can persist it across step navigation
      onUploadComplete?.(documentData.id, publicUrl, uri);
    } catch (error: any) {
      console.error("Upload error:", error);
      setJustPickedUri(null);
      setJustPickedMime(null);
      onError?.(error.message || "Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <View style={styles.card}>
        {justPickedUri && !isPdf ? (
          <View style={styles.uploadingWithPreview}>
            <Image source={justPickedUri} style={styles.uploadingThumb} contentFit="cover" />
            <View style={styles.uploadingInfo}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
      </View>
    );
  }

  if (hasFile) {
    return (
      <View style={styles.card}>
        <Text style={styles.previewLabel}>Uploaded document</Text>
        <View style={styles.previewWrap}>
          {!isPdf && previewUri ? (
            <Image
              key={previewUri}
              source={previewUri}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : isPdf ? (
            <View style={styles.pdfPlaceholder}>
              <Text style={styles.pdfIcon}>📄</Text>
              <Text style={styles.pdfLabel}>PDF document uploaded</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewFooter}>
          <View style={styles.uploadedBadge}>
            <Text style={styles.uploadedBadgeText}>✓ Uploaded</Text>
          </View>
          <TouchableOpacity onPress={pickDocument} style={styles.reuploadLink}>
            <Text style={styles.reuploadLinkText}>Re-upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={pickDocument}
      activeOpacity={0.7}
    >
      <View style={styles.uploadContainer}>
        <Text style={styles.uploadIcon}>📄</Text>
        <Text style={styles.uploadText}>Upload Document</Text>
        <Text style={styles.uploadHint}>PDF, JPG, or PNG (max 10MB)</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 100,
    justifyContent: "center",
  },
  uploadingContainer: {
    alignItems: "center",
  },
  uploadingWithPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  uploadingThumb: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  uploadingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  uploadingText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  previewWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  pdfPlaceholder: {
    width: 200,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfIcon: { fontSize: 48 },
  pdfLabel: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.sm },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  uploadedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
  uploadedBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "600",
  },
  reuploadLink: {},
  reuploadLinkText: {
    ...typography.bodySmall,
    color: colors.accent,
  },
  uploadContainer: {
    alignItems: "center",
  },
  uploadIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  uploadText: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  uploadHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
