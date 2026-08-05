import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Video, ResizeMode } from "expo-av";
import { supabase } from "../../lib/supabase";
import { fetchApi } from "../../lib/api";
import { colors, spacing, radius, typography } from "../../theme";

type IntroStatus = "none" | "processing" | "pending" | "approved" | "rejected";

const STATUS_COPY: Record<IntroStatus, { label: string; tone: string }> = {
  none: { label: "", tone: colors.textMuted },
  processing: { label: "Processing your video…", tone: colors.textMuted },
  pending: { label: "In review — visible to venues once approved", tone: colors.warning },
  approved: { label: "Live — venues can watch this", tone: colors.accent },
  rejected: { label: "Not approved — please record another", tone: colors.error },
};

export function IntroVideoSection() {
  const [status, setStatus] = useState<IntroStatus>("none");
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("personnel")
        .select("intro_video_status, intro_video_playback_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setStatus(((data as any).intro_video_status as IntroStatus) || "none");
        setPlaybackId((data as any).intro_video_playback_id || null);
      }
    } catch {
      // table/columns may not exist yet — leave as 'none'
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pollProcessing = useCallback(
    async (uploadId: string | undefined, token: string) => {
      // Poll up to ~2 minutes; Mux usually finishes a short clip in seconds.
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const res = await fetchApi("/api/intro-video/status", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uploadId }),
          });
          const j = await res.json().catch(() => ({}));
          if (j.status && j.status !== "processing") {
            setStatus(j.status);
            if (j.playbackId) setPlaybackId(j.playbackId);
            return;
          }
        } catch {
          // keep polling
        }
      }
    },
    [],
  );

  const uploadFromUri = useCallback(async (uri: string) => {
    setBusy(true);
    try {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        Alert.alert("Please log in again");
        return;
      }
      const res = await fetchApi("/api/intro-video/upload-url", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.uploadUrl) {
        Alert.alert("Upload failed", json.error || "Please try again.");
        return;
      }
      // Stream the whole file to Mux. (A plain fetch+blob PUT truncates large
      // videos in React Native, producing 1-2s clips.)
      const put = await FileSystem.uploadAsync(json.uploadUrl, uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": "video/mp4" },
      });
      if (put.status < 200 || put.status >= 300) {
        Alert.alert("Upload failed", "Could not upload the video. Please try again.");
        return;
      }
      setStatus("processing");
      Alert.alert(
        "Uploaded",
        "Your intro video is processing. We'll let you know once it's ready.",
      );
      // Poll for transcoding to finish (works even without a webhook in dev).
      pollProcessing(json.uploadId, token);
    } catch (e: any) {
      Alert.alert("Upload error", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const pick = useCallback(
    async (fromCamera: boolean) => {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow camera/library access to add your intro video.",
        );
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["videos"],
            videoMaxDuration: 60,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["videos"],
            videoMaxDuration: 60,
            quality: 0.7,
          });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadFromUri(result.assets[0].uri);
    },
    [uploadFromUri],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Intro video</Text>
      <Text style={styles.subtitle}>
        A short clip (up to 60s) introducing yourself helps venues choose you.
        Say your name, your experience, and why you&apos;re great on the door.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
      ) : (
        <>
          {status === "approved" && playbackId && (
            <Video
              source={{ uri: `https://stream.mux.com/${playbackId}.m3u8` }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              style={styles.preview}
            />
          )}

          {!busy && status !== "none" && STATUS_COPY[status].label ? (
            <Text style={[styles.statusText, { color: STATUS_COPY[status].tone }]}>
              {status === "processing" ? "● " : ""}
              {STATUS_COPY[status].label}
            </Text>
          ) : null}

          {busy ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.uploadingText}>Uploading…</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => pick(true)}
              >
                <Text style={styles.btnPrimaryText}>
                  {status === "approved" || status === "rejected" || status === "pending"
                    ? "Record new"
                    : "Record video"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => pick(false)}
              >
                <Text style={styles.btnGhostText}>Upload from library</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { ...typography.titleCard, color: colors.text, fontSize: 16 },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  preview: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 360,
    borderRadius: radius.md,
    backgroundColor: "#000",
    marginTop: spacing.md,
  },
  statusText: { ...typography.caption, marginTop: spacing.sm, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#03120f", fontWeight: "700", fontSize: 14 },
  btnGhost: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  btnGhostText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
  },
  uploadingText: { ...typography.caption, color: colors.textMuted },
});
