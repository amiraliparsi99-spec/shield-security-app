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
import { supabase } from "../../lib/supabase";
import { colors, typography, spacing, radius } from "../../theme";

interface DocumentUploadProps {
  ownerType: "personnel" | "agency";
  ownerId: string;
  documentType: string;
  documentName: string;
  onUploadComplete?: (documentId: string) => void;
  onError?: (error: string) => void;
}

export function DocumentUpload({
  ownerType,
  ownerId,
  documentType,
  documentName,
  onUploadComplete,
  onError,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickDocument = async () => {
    try {
      // Request permissions for image picker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant camera roll permissions to upload documents.");
        return;
      }

      // Show action sheet to choose between camera and library
      Alert.alert(
        "Upload Document",
        "Choose how you want to upload your document",
        [
          {
            text: "Take Photo",
            onPress: () => pickImageFromCamera(),
          },
          {
            text: "Choose from Library",
            onPress: () => pickImageFromLibrary(),
          },
          {
            text: "Choose PDF",
            onPress: () => pickPDF(),
          },
          {
            text: "Cancel",
            style: "cancel",
          },
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
        const asset = result.assets[0];
        await uploadFile(asset.uri, "application/pdf", "pdf");
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

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(mimeType)) {
      onError?.("Invalid file type. Please upload PDF, JPG, or PNG files only.");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Read file as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (blob.size > maxSize) {
        onError?.("File size too large. Maximum size is 10MB.");
        setUploading(false);
        return;
      }

      // Generate unique file name
      const fileName = `${ownerType}/${ownerId}/${documentType}-${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, blob, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("verification-documents").getPublicUrl(fileName);

      // Create document record in database
      const { data: documentData, error: dbError } = await supabase
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

      if (dbError) throw dbError;

      setProgress(100);
      onUploadComplete?.(documentData.id);
      Alert.alert("Success", "Document uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      onError?.(error.message || "Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
      onPress={pickDocument}
      disabled={uploading}
      activeOpacity={0.7}
    >
      {uploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      ) : (
        <View style={styles.uploadContainer}>
          <Text style={styles.uploadIcon}>📄</Text>
          <Text style={styles.uploadText}>Upload Document</Text>
          <Text style={styles.uploadHint}>PDF, JPG, or PNG (max 10MB)</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadingContainer: {
    alignItems: "center",
  },
  uploadingText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  uploadContainer: {
    alignItems: "center",
  },
  uploadIcon: {
    fontSize: 32,
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
