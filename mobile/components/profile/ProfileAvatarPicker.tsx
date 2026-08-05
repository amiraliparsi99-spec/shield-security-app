import { useState } from "react";
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
import { colors, typography, spacing, radius } from "../../theme";
import { supabase } from "../../lib/supabase";
import { uploadProfileAvatar } from "../../lib/uploadAvatar";
import { safeHaptic } from "../../lib/haptics";

type Props = {
  userId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
};

export function ProfileAvatarPicker({
  userId,
  profileId,
  displayName,
  avatarUrl,
  onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const initials = (displayName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pick = async (source: "camera" | "library") => {
    if (!supabase) return;

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert(
        "Permission needed",
        source === "camera"
          ? "Allow camera access to take a profile photo."
          : "Allow photo library access to choose a profile photo.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const url = await uploadProfileAvatar(supabase, {
        userId,
        profileId,
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
      });
      onChange(url);
      safeHaptic("success");
    } catch (e: any) {
      safeHaptic("error");
      Alert.alert("Upload failed", e?.message || "Could not upload your photo.");
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    Alert.alert("Profile photo", "Choose how to add your photo", [
      { text: "Take photo", onPress: () => void pick("camera") },
      { text: "Choose from library", onPress: () => void pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.avatarBtn}
        onPress={openPicker}
        disabled={uploading}
        activeOpacity={0.85}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.badge}>
          {uploading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.badgeText}>📷</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.copy}>
        <Text style={styles.title}>Profile photo</Text>
        <Text style={styles.subtitle}>
          Stand out when agencies have multiple guards with the same name. Your photo shows on roster
          cards and shift assignments.
        </Text>
        <TouchableOpacity onPress={openPicker} disabled={uploading} activeOpacity={0.85}>
          <Text style={styles.action}>
            {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarBtn: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(0,212,170,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.35)",
  },
  avatarInitials: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    fontSize: 14,
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  action: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
