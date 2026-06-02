/**
 * /signup/oauth-complete
 *
 * Where new Apple/Google sign-ups land. The auth user already exists at this
 * point (OAuth created it), but they have no profile/personnel/venue/agency
 * row yet. This screen collects:
 *   1. Role (personnel / venue / agency)
 *   2. The minimum role-specific fields needed to make the row valid
 *   3. The same notification + location permission gate everyone else hits
 *
 * Anything optional on the email/password signup forms is intentionally
 * skipped here — users complete the rest from profile-edit after first login.
 * This is the "10× faster signup" promised by OAuth; we don't want to undo it
 * with a 30-field form.
 */

import * as Device from "expo-device";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { isMissingColumnError } from "../../lib/postgresErrors";
import { colors, radius, spacing, typography } from "../../theme";
import {
  PermissionsStep,
  permissionsReady,
  type PermissionsCapture,
} from "../../components/auth/PermissionsStep";

type Role = "personnel" | "venue" | "agency";

const SERVICES: { value: string; label: string }[] = [
  { value: "door_supervision", label: "Door Supervision" },
  { value: "event_security", label: "Event Security" },
  { value: "corporate_security", label: "Corporate Security" },
  { value: "retail_security", label: "Retail Security" },
  { value: "close_protection", label: "Close Protection" },
  { value: "cctv_monitoring", label: "CCTV Monitoring" },
];

const VENUE_TYPES: { value: string; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "club", label: "Nightclub" },
  { value: "restaurant", label: "Restaurant" },
  { value: "event", label: "Event Space" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
];

export default function OAuthComplete() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsCapture | null>(null);

  // Personnel + venue + agency share these
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");

  // Venue/Agency only
  const [businessName, setBusinessName] = useState("");
  // Venue only
  const [venueType, setVenueType] = useState<string>("");
  const [addressLine1, setAddressLine1] = useState("");
  // Agency only
  const [services, setServices] = useState<string[]>([]);

  // Hydrate session info
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    (async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) {
        // No session — bounce back to login.
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const candidate =
        (typeof meta.display_name === "string" && meta.display_name) ||
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        "";
      if (candidate) setFullName(candidate);
    })();
  }, []);

  const toggleService = (s: string) => {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const requireLocation = role === "personnel";
  const canSubmit =
    !!role &&
    !!fullName.trim() &&
    !!city.trim() &&
    (role === "personnel" ||
      (role === "venue" && businessName.trim().length > 0 && addressLine1.trim().length > 0) ||
      (role === "agency" && businessName.trim().length > 0 && services.length > 0)) &&
    permissionsReady(permissions, requireLocation) &&
    !submitting;

  const handleSubmit = async () => {
    if (!supabase || !userId || !role) return;
    if (!fullName.trim()) {
      Alert.alert("Name needed", "Please enter your full name.");
      return;
    }
    if (!city.trim()) {
      Alert.alert("City needed", "Please enter your city.");
      return;
    }
    if (role === "venue" && (!businessName.trim() || !addressLine1.trim())) {
      Alert.alert("Venue details", "Please enter the venue name and address.");
      return;
    }
    if (role === "agency" && (!businessName.trim() || services.length === 0)) {
      Alert.alert("Agency details", "Please enter the agency name and choose at least one service.");
      return;
    }
    if (!permissionsReady(permissions, requireLocation)) {
      Alert.alert(
        requireLocation ? "Permissions required" : "Notifications required",
        requireLocation
          ? "Please enable notifications and location to finish."
          : "Please enable notifications to finish."
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. profiles row
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: userId,
        user_id: userId,
        email,
        role,
        display_name: fullName.trim(),
      });
      if (profileErr) {
        console.error("[OAuthComplete] profile upsert:", profileErr);
        throw new Error("Failed to create profile");
      }

      // 2. role-specific row
      if (role === "personnel") {
        const base = {
          user_id: userId,
          display_name: fullName.trim(),
          city: city.trim(),
          postcode: postcode.trim() || null,
          skills: [] as string[],
          experience_years: 0,
          hourly_rate: 16.0,
          bio: null as string | null,
        };
        const withPerms = {
          ...base,
          notifications_granted_at: permissions?.notifications.grantedAt ?? null,
          location_permission: permissions?.location.level ?? null,
          location_granted_at: permissions?.location.grantedAt ?? null,
        };
        let { error } = await supabase.from("personnel").insert(withPerms);
        if (error && isMissingColumnError(error)) {
          const retry = await supabase.from("personnel").insert(base);
          error = retry.error;
        }
        if (error) console.error("[OAuthComplete] personnel insert:", error);
      } else if (role === "venue") {
        const base = {
          user_id: userId,
          name: businessName.trim(),
          address_line1: addressLine1.trim(),
          address_line2: null,
          city: city.trim(),
          postcode: postcode.trim() || "",
          type: venueType || null,
          phone: null as string | null,
          email: email || null,
          is_active: true,
        };
        const withPerms = {
          ...base,
          notifications_granted_at: permissions?.notifications.grantedAt ?? null,
        };
        let { error } = await supabase.from("venues").insert(withPerms);
        if (error && isMissingColumnError(error)) {
          const retry = await supabase.from("venues").insert(base);
          error = retry.error;
        }
        if (error) console.error("[OAuthComplete] venue insert:", error);
      } else if (role === "agency") {
        const base = {
          owner_id: userId,
          name: businessName.trim(),
          address: `${city.trim()}${postcode ? ", " + postcode.trim() : ""}`,
          city: city.trim(),
          postcode: postcode.trim() || "",
          location_name: city.trim(),
          services,
          contact_name: fullName.trim(),
          contact_email: email || null,
        };
        const withPerms = {
          ...base,
          notifications_granted_at: permissions?.notifications.grantedAt ?? null,
        };
        let { error } = await supabase.from("agencies").insert(withPerms);
        if (error && isMissingColumnError(error)) {
          const retry = await supabase.from("agencies").insert(base);
          error = retry.error;
        }
        if (error) console.error("[OAuthComplete] agency insert:", error);
      }

      // 3. push token
      const pushToken = permissions?.notifications.token;
      if (pushToken) {
        const { error: pushErr } = await supabase.from("push_tokens").upsert(
          {
            user_id: userId,
            token: pushToken,
            platform: Platform.OS,
            device_name: Device.deviceName || "Unknown",
            is_active: true,
          },
          { onConflict: "user_id,token" }
        );
        if (pushErr) console.warn("[OAuthComplete] push_tokens upsert:", pushErr.message);
      }

      router.replace("/(tabs)/explore");
    } catch (err) {
      const e = err as { message?: string };
      Alert.alert("Error", e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🛡️</Text>
          </View>
          <Text style={styles.headerTitle}>Finish setting up</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}. Just a couple of details so we
          know who you are.
        </Text>

        <Text style={styles.sectionLabel}>I'm here as a…</Text>
        <View style={styles.roleRow}>
          {(
            [
              { id: "personnel", icon: "🛡️", label: "Security pro" },
              { id: "venue", icon: "🏢", label: "Venue" },
              { id: "agency", icon: "🏛️", label: "Agency" },
            ] as { id: Role; icon: string; label: string }[]
          ).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.roleTile, role === r.id && styles.roleTileActive]}
              onPress={() => setRole(r.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.roleTileIcon}>{r.icon}</Text>
              <Text
                style={[styles.roleTileLabel, role === r.id && styles.roleTileLabelActive]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {role && (
          <>
            <Text style={styles.sectionLabel}>About you</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {role === "personnel" ? "Full Name *" : "Your Name *"}
              </Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {(role === "venue" || role === "agency") && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {role === "venue" ? "Venue Name *" : "Agency Name *"}
                </Text>
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder={role === "venue" ? "e.g. The Lions Den" : "e.g. Acme Security Ltd"}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}

            {role === "venue" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Venue Address *</Text>
                <TextInput
                  style={styles.input}
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="Address line 1"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Birmingham"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: spacing.md }]}>
                <Text style={styles.label}>Postcode</Text>
                <TextInput
                  style={styles.input}
                  value={postcode}
                  onChangeText={setPostcode}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {role === "venue" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Venue Type</Text>
                <View style={styles.chipRow}>
                  {VENUE_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.chip, venueType === t.value && styles.chipActive]}
                      onPress={() => setVenueType(t.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          venueType === t.value && styles.chipTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {role === "agency" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Services Offered *</Text>
                <View style={styles.chipRow}>
                  {SERVICES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, services.includes(s.value) && styles.chipActive]}
                      onPress={() => toggleService(s.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          services.includes(s.value) && styles.chipTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.permissionsBlock}>
              <PermissionsStep
                requireLocation={requireLocation}
                onChange={setPermissions}
                submitting={submitting}
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitBtnText}>Finish</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { ...typography.title, color: colors.text },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: "700",
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleTile: {
    flex: 1,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  roleTileActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  roleTileIcon: { fontSize: 22 },
  roleTileLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  roleTileLabelActive: { color: colors.accent },
  fieldGroup: { marginBottom: spacing.md },
  row: { flexDirection: "row" },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.accent },
  permissionsBlock: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.background,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { ...typography.body, fontWeight: "700", color: "#000" },
});
